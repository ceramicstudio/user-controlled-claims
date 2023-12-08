import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import * as u8a from "uint8arrays";
import { hash } from "@stablelib/sha256";
import { useWalletClient } from "wagmi";
import { EthereumAuthProvider } from "@ceramicnetwork/blockchain-utils-linking";
import { DIDSession } from "did-session";
import { EthereumWebAuth, getAccountId } from "@didtools/pkh-ethereum";
import { RuntimeCompositeDefinition } from "@composedb/types";
import { CeramicClient } from "@ceramicnetwork/http-client";
import { ComposeClient } from "@composedb/client";
import { definition } from "../__generated__/definition";
import { GetWalletClientResult } from "@wagmi/core";
import {DID } from "dids";
import { Ed25519Provider } from "key-did-provider-ed25519";
import KeyResolver from "key-did-resolver";

type ComposeDBProps = {
  children: ReactNode;
};

const CERAMIC_URL = process.env.URL ?? "http://localhost:7007";

/**
 * Configure ceramic Client & create context.
 */
const ceramic = new CeramicClient(CERAMIC_URL);

//@ts-ignore
const compose = new ComposeClient({
  ceramic,
  definition: definition as RuntimeCompositeDefinition,
});

let isAuthenticated = false;
let keySeed = "";

const Context = createContext({ compose, isAuthenticated, keySeed });

export const ComposeDB = ({ children }: ComposeDBProps) => {
  function StartAuth(isAuthenticated: boolean = false) {
    const { data: walletClient, isError, isLoading } = useWalletClient();
    const [isAuth, setAuth] = useState(false);

    useEffect(() => {
      async function authenticate(
        walletClient: GetWalletClientResult | undefined
      ) {
        if (walletClient ) {
          // const accountId = await getAccountId(walletClient, walletClient.account.address)
          // const authProvider = new EthereumAuthProvider(walletClient, walletClient.account.address)
          // console.log(walletClient.account.address, accountId)
          // const authMethod = await EthereumWebAuth.getAuthMethod(walletClient, accountId)
          // // change to use specific resource
          // const session = await DIDSession.get(accountId, authMethod, { resources: compose.resources })
          // //@ts-ignore
          // await ceramic.setDID(session.did)
          const userPrompt =
            "Give this app permission to read or write your verifiable credential data";

          // const accounts = await window.ethereum.request({
          //   method: "eth_requestAccounts",
          // });
          //@ts-ignore
          const entropy = await window.ethereum.request({
            method: "personal_sign",
            params: [
              u8a.toString(u8a.fromString(userPrompt), "base16"),
              walletClient.account.address,
            ],
          });

          const seed = hash(u8a.fromString(entropy.slice(2), "base16"));
          const stringSeed = u8a.toString(seed, "base16");
          keySeed = stringSeed;

          const did = new DID({
            //@ts-ignore
            resolver: KeyResolver.getResolver(),
            provider: new Ed25519Provider(seed),
          });
          await did.authenticate();
          await ceramic.setDID(did)
          console.log("Auth'd:", did.id);
          localStorage.setItem("did", did.id);
          setAuth(true);
        }
      }
      authenticate(walletClient);
    }, [walletClient]);

    return isAuth;
  }

  if (!isAuthenticated) {
    isAuthenticated = StartAuth();
  }

  return (
    <Context.Provider value={{ compose, isAuthenticated, keySeed }}>
      {children}
    </Context.Provider>
  );
};

export const useComposeDB = () => useContext(Context);
