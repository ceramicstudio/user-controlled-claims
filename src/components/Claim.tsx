import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { GraphiQL } from "graphiql";
import { ComposeClient } from "@composedb/client";
import { RuntimeCompositeDefinition } from "@composedb/types";
import { definition } from "../__generated__/definition.js";
import { getEthTypesFromInputDoc } from "eip-712-types-generation";
import { CredentialPayload } from "@veramo/core";
import KeyResolver from "key-did-resolver";
import {
  processEntryToArray,
  MANDATORY_CREDENTIAL_CONTEXT,
} from "@veramo/utils";
import "graphiql/graphiql.min.css";
import { useComposeDB } from "../fragments/index";
import { DID } from "dids";

enum ClaimTypes {
  verifiableCredential = "verifiableCredential",
  baseCredentail = "baseCredential",
}

type Queries = {
  values: [{ query: string }, { query: string }];
};

export default function Create() {
  const { compose, keySession } = useComposeDB();
  const { address, isDisconnected } = useAccount();
  const [attesting, setAttesting] = useState(false);
  const [claim, setClaim] = useState<ClaimTypes>(ClaimTypes.baseCredentail);
  const [loggedIn, setLoggedIn] = useState(false);
  const [destination, setDestination] = useState<string>("");
  const [signature, setSignature] = useState<"EIP712" | "JWT">("EIP712");

  const [queries, setQueries] = useState<Queries>({
    values: [
      {
        query: `query VerifiableCredentials {
          verifiableClaimIndex(last: 1) {
            edges {
              node {
                recipient {
                  id
                }
                controller {
                  id
                }
                ... on VerifiableCredential {
                  expirationDate
                  context
                  ... on VCEIP712Proof {
                    proof {
                      created
                    }
                    ... on AccountTrustCredential712 {
                      trusted
                    }
                  }
                  ... on VCJWTProof {
                    proof {
                      type
                      jwt
                    }
                  }
                }
              }
            }
          }
        }`,
      },
      {
        query: `query BaseCredentials{
        trustIndex(last: 1){
          edges{
            node{
              recipient{
                id
              }
              controller {
                id
              }
              trusted
              jwt
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

  const saveBaseCredential = async () => {
    const credential = {
      recipient: `did:pkh:eip155:1:${destination.toLowerCase()}`,
      trusted: true,
    };

    if (keySession) {
      const jws = await keySession.did.createJWS(credential);
      const jwsJsonStr = JSON.stringify(jws);
      const jwsJsonB64 = Buffer.from(jwsJsonStr).toString("base64");
      const completeCredential = {
        ...credential,
        jwt: jwsJsonB64,
      };
      const data = await compose.executeQuery(`
      mutation{
        createTrust(input: {
          content: {
            recipient: "${completeCredential.recipient}"
            trusted: ${completeCredential.trusted}
            jwt: "${completeCredential.jwt}"
          }
        })
        {
          document{
            id
            recipient{
              id
            }
            trusted
            jwt
          }
        }
      }
    `);
      console.log(data);
      await validateBaseCredential();
    }
  };

  const validateBaseCredential = async () => {
    const credential: any = await compose.executeQuery(
      `query {
        trustIndex(last: 1){
          edges{
            node{
              recipient{
                id
              }
              controller {
                id
              }
              trusted
              jwt
            }
          }
        }
      }`);
    if(credential.data.trustIndex !== null){
      const credentialToValidate = credential.data.trustIndex.edges[0].node.jwt;
      const json = Buffer.from(credentialToValidate, "base64").toString();
      const parsed = JSON.parse(json);
      console.log(parsed);
      //@ts-ignore
      const newDid = new DID({ resolver: KeyResolver.getResolver() });
      const result = await newDid.verifyJWS(parsed);
      console.log(result);
    }
  };

  const saveCredential = async (credential: any) => {
    console.log(credential);
    const data: any = await compose.executeQuery(`
      mutation {
        createAccountTrustCredential712(input: {
          content: {
              context: ${JSON.stringify(credential["@context"]).replace(
                /"([^"]+)":/g,
                "$1:"
              )}
              issuer: {
                id: "${credential.issuer}"
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

  const saveJwt = async (credential: any) => {
    const data: any = await compose.executeQuery(`
      mutation {
        createAccountTrustCredentialJWT(input: {
          content: {
              context: ${JSON.stringify(credential["@context"]).replace(
                /"([^"]+)":/g,
                "$1:"
              )}
              issuer: {
                id: "${credential.issuer}"
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
                  type: "${credential.proof.type}"
                  jwt: "${credential.proof.jwt}"
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
              jwt
            }
          }
        }
      }
    `);
    console.log(data);
  };

  const create712Credential = async () => {
    const id = localStorage.getItem("did");
    if (!id) return;

    const cred = {
      issuer: id,
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://beta.api.schemas.serto.id/v1/public/trusted-reviewer/1.0/ld-context.json",
      ],
      type: ["VerifiableCredential", "Trusted"],
      credentialSchema: {
        id: "https://beta.api.schemas.serto.id/v1/public/trusted/1.0/json-schema.json",
        type: "JsonSchemaValidator2018",
      },
      credentialSubject: {
        isTrusted: true,
        id: `did:pkh:eip155:1:${destination.toLowerCase()}`,
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

    //@ts-ignore
    const jws = await keySession.did.createJWS({
      domain,
      types,
      message,
      primaryType,
    });
    const jwsJsonStr = JSON.stringify(jws);
    const jwsJsonB64 = Buffer.from(jwsJsonStr).toString("base64");
    credFinal["proof"]["proofValue"] = jwsJsonB64;
    credFinal["proof"]["eip712"] = {
      domain,
      types: allTypes,
      primaryType,
    };
    console.log(credFinal);
    saveCredential(credFinal);
    // const newDid = new DID({ resolver: KeyResolver.getResolver() });
    // const result = await newDid.verifyJWS(jws);
    // const parentDid = keySession?.did._parentId;
  };

  const createJwtCredential = async () => {
    const id = localStorage.getItem("did");
    if (!id) return;

    const cred = {
      issuer: id,
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://beta.api.schemas.serto.id/v1/public/trusted-reviewer/1.0/ld-context.json",
      ],
      type: ["VerifiableCredential", "Trusted"],
      credentialSchema: {
        id: "https://beta.api.schemas.serto.id/v1/public/trusted/1.0/json-schema.json",
        type: "JsonSchemaValidator2018",
      },
      credentialSubject: {
        isTrusted: true,
        id: `did:pkh:eip155:1:${destination.toLowerCase()}`,
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
        type: "JwtProof2020",
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
    //const data = JSON.stringify({ domain, types, message, primaryType });
    // const provider = ethers.providers.getDefaultProvider("mainnet");
    // const signer = new ethers.Wallet(keySeed, provider);

    //@ts-ignore
    const jws = await keySession.did.createJWS({
      domain,
      types,
      message,
      primaryType,
    });
    const jwsJsonStr = JSON.stringify(jws);
    const jwsJsonB64 = Buffer.from(jwsJsonStr).toString("base64");
    credFinal["proof"]["jwt"] = jwsJsonB64;
    console.log(credFinal);
    saveJwt(credFinal);
  };

  const createClaim = async () => {
    if (claim === ("verifiableCredential" as ClaimTypes)) {
      if (signature === "EIP712") {
        const credential = await create712Credential();
        console.log(credential);
      } else {
        const credential = await createJwtCredential();
        console.log(credential);
      }
    }
    if (claim === ("baseCredential" as ClaimTypes)) {
      await saveBaseCredential();
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
                <option value="verifiableCredential">
                  Verifiable Credential
                </option>
                <option value="baseCredential">Base Credential</option>
              </select>
            </form>

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
            )}
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
