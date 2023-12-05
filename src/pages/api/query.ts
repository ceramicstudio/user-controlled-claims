import { CeramicClient } from "@ceramicnetwork/http-client";
import { ComposeClient } from "@composedb/client";
import { RuntimeCompositeDefinition } from "@composedb/types";
import { DID } from "dids";
import { NextApiRequest, NextApiResponse } from "next";
import { definition } from "../../__generated__/definition.js";

export default async function createCredential(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  //instantiate a composeDB client instance
  const composeClient = new ComposeClient({
    ceramic: "http://localhost:7007",
    definition: definition as RuntimeCompositeDefinition,
  });

  try {
    const data: any = await composeClient.executeQuery(`
      query {
        verifiableCredentialIndex(last: 1){
            edges {
                node {
                    issuer {
                        id
                      }
                    context
                    type
                    credentialSchema {
                        id
                        type
                    }
                    issuanceDate
                    credentialSubject{
                        id {
                          id
                        }
                        isTrusted
                      }
                      proof {
                        verificationMethod
                        created
                        proofPurpose
                        type
                        proofValue
                        eip712{
                          domain{
                            chainId
                            name
                            version
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
      }
    `);
    return res.json(data);
  } catch (err) {
    res.json({
      err,
    });
  }
}
