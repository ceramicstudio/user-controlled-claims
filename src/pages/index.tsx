import Head from "next/head";
import Nav from "../components/Navbar";
import Attest from "../components/Claim";
import type { NextPage } from "next";
import { useEffect, useState } from "react";
import {  useAccount } from "wagmi";

const Home: NextPage = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const { address, isDisconnected } = useAccount();

  useEffect(() => {
    if (address) {
      setLoggedIn(true);
    }
  }, [address]);

  return (
    <>
      <Nav />
      <Head>
        <title>Save Verifiable Credentials to Ceramic</title>
        <meta name="description" content="" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {loggedIn ? (
        <main className="bg-gray">
          <Attest />
        </main>
      ) : (
        <main className="bg-gray"></main>
      )}
    </>
  );
};

export default Home;
