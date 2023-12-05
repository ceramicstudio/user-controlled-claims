import { ComposeClient } from "@composedb/client";
import { RuntimeCompositeDefinition } from "@composedb/types";
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
        verifiableCredentialJWSIndex(last: 1){
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
                        type
                        jwt
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
