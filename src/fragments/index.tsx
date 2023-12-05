import { createContext, useContext, useState, useEffect, ReactNode } from "react";

import { useWalletClient } from 'wagmi'
import { EthereumAuthProvider } from '@ceramicnetwork/blockchain-utils-linking'
import { DIDSession } from 'did-session'
import { EthereumWebAuth, getAccountId } from '@didtools/pkh-ethereum'
import { RuntimeCompositeDefinition } from "@composedb/types";
import { CeramicClient } from "@ceramicnetwork/http-client"
import { ComposeClient } from "@composedb/client";
import { definition } from "../__generated__/definition";
import { GetWalletClientResult } from "@wagmi/core";

type ComposeDBProps = {
  children: ReactNode;
};

const CERAMIC_URL = process.env.URL ?? "http://localhost:7007";

/**
 * Configure ceramic Client & create context.
 */
const ceramic = new CeramicClient(CERAMIC_URL);

//@ts-ignore
const compose = new ComposeClient({ ceramic, definition: definition as RuntimeCompositeDefinition });

let isAuthenticated = false


const Context = createContext({ compose, isAuthenticated });



export const ComposeDB = ({ children }: ComposeDBProps) => {


  function StartAuth (isAuthenticated: boolean = false) {
    const { data: walletClient, isError, isLoading } = useWalletClient()
    const [ isAuth, setAuth ] = useState(false)

    useEffect(() => {
      async function authenticate(walletClient: GetWalletClientResult | undefined) {

        if (walletClient) {
          const accountId = await getAccountId(walletClient, walletClient.account.address)
          const authProvider = new EthereumAuthProvider(walletClient, walletClient.account.address)
          console.log(walletClient.account.address, accountId)
          const authMethod = await EthereumWebAuth.getAuthMethod(walletClient, accountId)
          // change to use specific resource
          const session = await DIDSession.get(accountId, authMethod, { resources: compose.resources }) 
          //@ts-ignore
          await ceramic.setDID(session.did)
          console.log('Auth\'d:', session.did.parent)
          localStorage.setItem('did', session.did.parent)
          setAuth(true)
        }
      }
      authenticate(walletClient)
    }, [walletClient])

    return isAuth
  }

  if (!isAuthenticated) {
    isAuthenticated = StartAuth()
  }

  return (
    <Context.Provider value={{ compose, isAuthenticated }}>
      {children}
    </Context.Provider>
  );
};



export const useComposeDB = () => useContext(Context);

