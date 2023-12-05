import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'
import {ComposeDB} from "../fragments";
import type { AppProps } from 'next/app'
import { WagmiConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import "../../styles/styles.css";

const PROJECT_ID = '86e78deb6cf634c706f45426dd186bf7'

const chains = [mainnet]
const wagmiConfig = defaultWagmiConfig({ chains, projectId: PROJECT_ID })

createWeb3Modal({ wagmiConfig, projectId: PROJECT_ID, chains })


const MyApp = ({ Component, pageProps }: AppProps) => {
  return (
    <WagmiConfig config={wagmiConfig}>
    <ComposeDB>
      <Component {...pageProps} ceramic />
      </ComposeDB>
    </WagmiConfig>
  );
}

export default MyApp
