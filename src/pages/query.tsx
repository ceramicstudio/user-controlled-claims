"use client";
import Head from "next/head";
import Nav from "../components/Navbar";
import styles from "./index.module.css";
import type { NextPage } from "next";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { GraphiQL } from "graphiql";
import { definition } from "../__generated__/definition.js";
import { ComposeClient } from "@composedb/client";
import "graphiql/graphiql.min.css";

const Home: NextPage = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const { address, isDisconnected } = useAccount();


  const verifiableCredentialQuery = 
`
query VerifiableCredentialsAll {
  verifiableCredentialIndex(first: 10) {
    edges {
      node {
        controller {
          id
        }
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
        ... on AccountTrustCredential712 {
          credentialSubject {
            id {
              id
            }
            trustworthiness {
              type
              level
              scope
              reason
            }
          }
          proof {
            verificationMethod
            created
            proofPurpose
            type
            proofValue
            eip712 {
              domain {
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
}
`;

const verifiableCredentialQuery1 = 
`
query AccountTrustEIP712 {
  accountTrustCredential712Index(last: 1) {
    edges {
      node {
        credentialSubject {
          id {
            id
          }
          trustworthiness {
            type
            level
            scope
            reason
          }
        }
        issuanceDate
        proof {
          verificationMethod
          created
          proofPurpose
          type
          proofValue
          eip712 {
            domain {
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
`;

  const Queries = {
    values: [
      {query: verifiableCredentialQuery},
      {query: verifiableCredentialQuery1},
    ]
  }

  const fetcher = async (graphQLParams: Record<string, any>) => {
    const composeClient = new ComposeClient({
      ceramic: "http://localhost:7007",
      definition: definition as any,
    });

    const data = await composeClient.executeQuery(`${graphQLParams.query}`);
    console.log(data);

    if (data && data.data && !data.data.__schema) {
      return data.data;
    }
  };

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
      {!isDisconnected ? (
        <main className={styles.main}>
          {loggedIn && (
            <div style={{ height: "60rem", width: "90%", margin: "auto" }}>
                {/* @ts-ignore */}
              <GraphiQL fetcher={fetcher} storage={null} defaultTabs={Queries.values}/>
            </div>
          )}
        </main>
      ) : (
        <main className={styles.main}></main>
      )}
    </>
  );
};

export default Home;
