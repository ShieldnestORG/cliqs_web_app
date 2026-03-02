/**
 * Page Head Component
 *
 * File: components/head.tsx
 *
 * This component sets page-specific meta tags (title, description, OG tags).
 * Note: Google Fonts, favicons, and theme-color are now in pages/_document.tsx
 * to avoid Next.js 15 warnings about stylesheets in next/head.
 */

import NextHead from "next/head";

const defaultDescription = "Create multisigs and send tokens on any cosmos based chain";
const defaultOGURL = "";

interface Props {
  title?: string;
  description?: string;
  url?: string;
}

const Head = (props: Props) => (
  <NextHead>
    <meta charSet="UTF-8" />
    <title>{props.title || "Cosmos Multisig Manager"}</title>
    <meta name="description" content={props.description || defaultDescription} />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta property="og:url" content={props.url || defaultOGURL} />
    <meta property="og:title" content={props.title || "Cosmos Multisig Manager"} />
    <meta property="og:description" content={props.description || defaultDescription} />
  </NextHead>
);

export default Head;
