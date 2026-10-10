/**
 * Chain root (/{chain})
 *
 * Has no page of its own: Home is /{chain}/dashboard. This stays a route so a
 * request for /{chain}, or the client-side push to it after "Delete" in Data &
 * Privacy, resolves. It is a server redirect here rather than a next.config
 * redirect because a config redirect would also catch /robots.txt, /llms.txt
 * and /favicon.ico.
 */

import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const chainName = String(params?.chainName ?? "");

  return {
    redirect: {
      destination: `/${encodeURIComponent(chainName)}/dashboard`,
      permanent: false,
    },
  };
};

export default function ChainRoot() {
  return null;
}
