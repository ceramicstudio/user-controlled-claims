import { CeramicClient } from "@ceramicnetwork/http-client";
import { ComposeClient } from "@composedb/client";
import { RuntimeCompositeDefinition } from "@composedb/types";
import { DID } from "dids";
import { Ed25519Provider } from "key-did-provider-ed25519";
import KeyResolver from "key-did-resolver";
import { NextApiRequest, NextApiResponse } from "next";
import { fromString } from "uint8arrays/from-string";
import { definition } from "../../__generated__/definition.js";

const uniqueKey = process.env.SECRET_KEY;

export default async function createCredential(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const { toJson } = req.body;
  //instantiate a ceramic client instance
  const ceramic = new CeramicClient("http://localhost:7007");

  //instantiate a composeDB client instance
  const composeClient = new ComposeClient({
    ceramic: "http://localhost:7007",
    definition: definition as RuntimeCompositeDefinition,
  });

  //authenticate developer DID in order to create a write transaction
  const authenticateDID = async (seed: string) => {
    const key = fromString(seed, "base16");
    const provider = new Ed25519Provider(key);
    const staticDid = new DID({
      resolver: KeyResolver.getResolver(),
      provider,
    });
    await staticDid.authenticate();
    ceramic.did = staticDid;
    // @ts-expect-error: Ignore type error
    composeClient.setDID(staticDid);
    return staticDid;
  };

  if (uniqueKey) {
    try {
      await authenticateDID(uniqueKey);
      console.log(toJson.primaryType);

      const data: any = await composeClient.executeQuery(`
      mutation {
        createAccountAttestation(input: {
          content: {
            uid: "${toJson.uid}"
            schema: "${toJson.message.schema}"
            attester: "${"did:pkh:eip155:1:" + toJson.account}"
            verifyingContract: "${toJson.domain.verifyingContract}"
            easVersion: "${toJson.domain.version}"
            version: ${toJson.message.version}
            chainId: ${toJson.domain.chainId}
            trusted: ${true}
            r: "${toJson.signature.r}"
            s: "${toJson.signature.s}"
            v: ${toJson.signature.v}
            types: ${JSON.stringify(toJson.types.Attest)
              .replaceAll('"name"', "name")
              .replaceAll('"type"', "type")}
            recipient: "${"did:pkh:eip155:1:" + toJson.message.recipient}"
            refUID: "${toJson.message.refUID}"
            data: "${toJson.message.data}"
            time: ${toJson.message.time}
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
      return res.json(data);
    } catch (error) {
      console.log(error);
      return res.json({ error });
    }
  }
}
