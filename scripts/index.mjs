import { CeramicClient } from "@ceramicnetwork/http-client"
import { ComposeClient } from "@composedb/client";
import { definition } from "../src/__generated__/definition.js";
/**
 * Configure ceramic Client & create context.
 */
const ceramic = new CeramicClient("http://localhost:7007/");

const composeClient = new ComposeClient({
  ceramic: "http://localhost:7007/",
  // @ts-ignore
  definition: definition,
});

const CeramicContext = {ceramic: ceramic, composeClient: composeClient};

export default CeramicContext;