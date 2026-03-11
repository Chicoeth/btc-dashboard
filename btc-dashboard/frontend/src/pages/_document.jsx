import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        <meta name="description" content="Dashboard de métricas on-chain e de mercado do Bitcoin" />
        <meta name="theme-color" content="#0a0a0f" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
