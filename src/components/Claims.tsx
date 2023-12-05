import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { GraphiQL } from "graphiql";
import { ComposeClient } from "@composedb/client";
import { RuntimeCompositeDefinition } from "@composedb/types";
import { definition } from "../__generated__/definition.js";
import { getEthTypesFromInputDoc } from "eip-712-types-generation";
import { CredentialPayload } from "@veramo/core";
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import {
  extractIssuer,
  processEntryToArray,
  MANDATORY_CREDENTIAL_CONTEXT,
} from "@veramo/utils";
import "graphiql/graphiql.min.css";
import { useComposeDB } from "../fragments/index";
import { CUSTOM_SCHEMAS, activeChainConfig } from "utils/utils";

enum ClaimTypes {
  verifiableCredential = "verifiableCredential",
  attestation = "attestation",
}

type Queries = {
  values: [{ query: string }, { query: string }];
};

export default function Create() {
  const { compose } = useComposeDB();
  const { address, isDisconnected } = useAccount();
  const [attesting, setAttesting] = useState(false);
  const [claim, setClaim] = useState<ClaimTypes>(ClaimTypes.attestation);
  const [loggedIn, setLoggedIn] = useState(false);
  const [destination, setDestination] = useState<string>("");
 
  const [queries, setQueries] = useState<Queries>({
    values: [
      {
        query: `query VerifiableCredentials{
        verifiableClaimIndex(last: 1){
          edges{
            node{
              recipient{
                id
              }
              controller {
                id
              }
              ...on VerifiableCredential{
                expirationDate
                context
                ...on VCEIP712Proof{
                  proof{
                    created
                  }
                  ...on AccountTrustCredential712{
                    trusted
                  }
                }
              }
            }
          }
        }
      }`,
      },
      {
        query: `query Attestations{
        verifiableClaimIndex(last: 1){
          edges{
            node{
              recipient{
                id
              }
              controller {
                id
              }
              ...on AccountAttestation{
                r
                s
                v
                trusted
              }
            }
          }
        }
      }`,
      }, // Add an empty query object to fix the type error
    ],
  });


  const fetcher = async (graphQLParams: Record<string, any>) => {
    const composeClient = new ComposeClient({
      ceramic: "http://localhost:7007",
      definition: definition as RuntimeCompositeDefinition,
    });

    const data = await composeClient.executeQuery(`${graphQLParams.query}`);
    console.log(data);

    if (data && data.data && !data.data.__schema) {
      return data.data;
    }
  };

  const saveCredential = async (credential: any) => {
    const data: any = await compose.executeQuery(`
      mutation {
        createAccountTrustCredential712(input: {
          content: {
              context: ${JSON.stringify(credential["@context"]).replace(
                /"([^"]+)":/g,
                "$1:"
              )}
              issuer: {
                id: "${credential.issuer.id}"
              }
              recipient: "${credential.credentialSubject.id}"  
              trusted: ${credential.credentialSubject.isTrusted}
              type: ${JSON.stringify(credential.type).replace(
                /"([^"]+)":/g,
                "$1:"
              )}
              credentialSchema: ${JSON.stringify(
                credential.credentialSchema
              ).replace(/"([^"]+)":/g, "$1:")}
              issuanceDate: "${credential.issuanceDate}"
              credentialSubject: ${JSON.stringify(credential.credentialSubject)
                .replace(/"([^"]+)":/g, "$1:")
                .replace("isTrusted", "trusted")}
                proof: {
                  proofPurpose: "${credential.proof.proofPurpose}"
                  type: "${credential.proof.type}"
                  created: "${credential.proof.created}"
                  verificationMethod: "${credential.proof.verificationMethod}"
                  proofValue: "${credential.proof.proofValue}"
                  eip712: {
                    domain: ${JSON.stringify(
                      credential.proof.eip712.domain
                    ).replace(/"([^"]+)":/g, "$1:")}
                    types: ${JSON.stringify(
                      credential.proof.eip712.types
                    ).replace(/"([^"]+)":/g, "$1:")}
                    primaryType: "${credential.proof.eip712.primaryType}"
                  }
                }
            }
        }) 
        {
          document {
            id
            issuer {
              id
            }
            issuanceDate
            type
            context
            credentialSubject{
              id {
                id
              }
              trusted
            }
            proof{
              type
              proofPurpose
              verificationMethod
              proofValue
              created
              eip712{
                domain{
                  name
                  version
                  chainId
                }
                types {
                  EIP712Domain {
                    name
                    type
                  }
                  CredentialSchema {
                    name
                    type
                  }
                  CredentialSubject {
                    name
                    type
                  }
                  Proof {
                    name
                    type
                  }
                  VerifiableCredential {
                    name
                    type
                  }
                }
                primaryType
              }
            }
          }
        }
      }
    `);
    console.log(data);
  };

  const saveAttestation = async (attestation: any) => {
    const data: any = await compose.executeQuery(`
      mutation {
        createAccountAttestation(input: {
          content: {
            uid: "${attestation.uid}"
            schema: "${attestation.message.schema}"
            attester: "${"did:pkh:eip155:1:" + attestation.account}"
            verifyingContract: "${attestation.domain.verifyingContract}"
            easVersion: "${attestation.domain.version}"
            version: ${attestation.message.version}
            chainId: ${attestation.domain.chainId}
            trusted: ${true}
            r: "${attestation.signature.r}"
            s: "${attestation.signature.s}"
            v: ${attestation.signature.v}
            types: ${JSON.stringify(attestation.types.Attest)
              .replaceAll('"name"', "name")
              .replaceAll('"type"', "type")}
            recipient: "${"did:pkh:eip155:1:" + attestation.message.recipient}"
            refUID: "${attestation.message.refUID}"
            data: "${attestation.message.data}"
            time: ${attestation.message.time}
          }
        }) 
        {
          document {
            id
            uid
            schema
            attester {
              id
            }
            verifyingContract 
            easVersion
            trusted
            version 
            chainId 
            types{
              name
              type
            }
            r
            s
            v
            recipient {
              id
            }
            refUID
            data
            time
          }
        }
      }
    `);
    console.log(data)
    return data;
  };

  const createCredential = () => {
    const id = localStorage.getItem("did");
    if (!id) return;

    const cred = {
      issuer: id,
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://beta.api.schemas.serto.id/v1/public/trusted-reviewer/1.0/ld-context.json",
      ],
      type: ["VerifiableCredential", "TrustedReviewer"],
      credentialSchema: {
        id: "https://beta.api.schemas.serto.id/v1/public/trusted-reviewer/1.0/json-schema.json",
        type: "JsonSchemaValidator2018",
      },
      credentialSubject: {
        isTrusted: true,
        id: "did:pkh:eip155:1:0x514e3b94f0287caf77009039b72c321ef5f016e6",
      },
    };
    const credentialContext = processEntryToArray(
      cred?.["@context"],
      MANDATORY_CREDENTIAL_CONTEXT
    );
    const credentialType = processEntryToArray(
      cred?.type,
      "VerifiableCredential"
    );
    //@ts-ignore
    const issuer = extractIssuer(cred, { removeParameters: true });
    let chainId = 1;
    let issuanceDate = new Date().toISOString();

    const credFinal: CredentialPayload = {
      ...cred,
      "@context": credentialContext,
      type: credentialType,
      issuanceDate,
      proof: {
        verificationMethod: localStorage.getItem("did"),
        created: issuanceDate,
        proofPurpose: "assertionMethod",
        type: "EthereumEip712Signature2021",
      },
    };
    const message = credFinal;
    const domain = {
      chainId,
      name: "VerifiableCredential",
      version: "1",
    };
    const primaryType = "VerifiableCredential";
    const allTypes = getEthTypesFromInputDoc(credFinal, primaryType);
    const types = { ...allTypes };
    const data = JSON.stringify({ domain, types, message, primaryType });
    //@ts-ignore

    const sign = window.ethereum
      .request({
        method: "eth_signTypedData_v4",
        params: [address, data],
        from: address,
      })
      .then((signature: any) => {
        credFinal["proof"]["proofValue"] = signature;
        credFinal["proof"]["eip712"] = {
          domain,
          types: allTypes,
          primaryType,
        };
        console.log(credFinal);
        saveCredential(credFinal);
      });
  };

  const createAttestation = async () => {
    const eas = new EAS(activeChainConfig?.contractAddress ?? "");
    const provider = new ethers.providers.Web3Provider(
      window.ethereum as unknown as ethers.providers.ExternalProvider
    );
    const signer = provider.getSigner();
    eas.connect(signer);
    const offchain = await eas.getOffchain();
    const schemaEncoder = new SchemaEncoder("bool trusted");
    const encoded = schemaEncoder.encodeData([
      { name: "Human", type: "bool", value: true },
    ]);
    const time = Math.floor(Date.now() / 1000);
    const offchainAttestation = await offchain.signOffchainAttestation(
      {
        recipient: destination.toLowerCase(),
        // Unix timestamp of when attestation expires. (0 for no expiration)
        expirationTime: 0,
        // Unix timestamp of current time
        time,
        revocable: true,
        version: 1,
        nonce: 0,
        schema: CUSTOM_SCHEMAS.TRUST_SCHEMA,
        refUID:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        data: encoded,
      },
      signer
    );

    const userAddress = await signer.getAddress();
    const attestation = {
      ...offchainAttestation,
      account: userAddress.toLowerCase(),
    };
    console.log(attestation);
    const finalResult = await saveAttestation(attestation);
    return finalResult;
  };

  const createClaim = async () => {
    if (claim === ("verifiableCredential" as ClaimTypes)) {
      const credential = await createCredential();
      console.log(credential);
    }
    if (claim === ("attestation" as ClaimTypes)) {
      const attestation = await createAttestation();
      console.log(attestation);
    }
  };

  useEffect(() => {
    if (address) {
      setLoggedIn(true);
    }
  }, [address]);

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="m-auto w-1/2 h-1/2">
        {address && (
          <div className="right">
            <img alt="Network logo" className="logo" src={"/ethlogo.png"} />

            <p style={{ textAlign: "center" }}>
              {" "}
              Connected with: {address.slice(0, 6)}...{address.slice(-4)}{" "}
            </p>
          </div>
        )}

        <div className="GradientBar" />
        <div className="WhiteBox">
          <>
            <div className="subTitle"> I trust: </div>
            <div className="InputContainer">
              <input
                className="InputBlock"
                autoCorrect={"off"}
                autoComplete={"off"}
                autoCapitalize={"off"}
                placeholder={"Address"}
                value={destination}
                onChange={(e) => setDestination(e.target.value.toLowerCase())}
              />
            </div>
            <div>Select claim format</div>
            <form className="px-4 py-3 m-3">
              <select
                className="text-center"
                onChange={(values) =>
                  setClaim(values.target.value as unknown as ClaimTypes)
                }
                value={claim}
              >
                <option value="attestation">Attestation</option>
                <option value="verifiableCredential">
                  Verifiable Credential
                </option>
              </select>
            </form>
            {/* @ts-ignore
            {claim === "verifiableCredential" && (
              <>
                <div>Select a signature format</div>
                <form className="px-4 py-3 m-3">
                  <select
                    className="text-center"
                    onChange={(values) =>
                      setSignature(
                        values.target.value as unknown as "EIP712" | "JWT"
                      )
                    }
                    value={signature}
                  >
                    <option value="EIP712">EIP712</option>
                    <option value="JWT">JWT</option>
                  </select>
                </form>
              </>
            )} */}
          </>
          <button className="MetButton" onClick={createClaim}>
            {attesting ? "Creating Claim..." : "Generate Claim"}
          </button>
        </div>
      </div>
      {loggedIn && (
        <div style={{ height: "60rem", width: "90%", margin: "auto" }}>
          {/* @ts-ignore */}
          <GraphiQL
            fetcher={fetcher}
            // @ts-ignore
            storage={null}
            defaultTabs={queries.values}
          />
        </div>
      )}
    </div>
  );
}
