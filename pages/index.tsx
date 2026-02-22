import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useChains } from '@/context/ChainsContext';

export default function Home() {
  const router = useRouter();
  const { chain } = useChains();

  useEffect(() => {
    // If we have a chain in context, redirect to its dashboard
    if (chain?.registryName) {
      router.replace(`/${chain.registryName}/dashboard`);
    } else {
      // Fallback to cosmoshub dashboard as the default entry point
      router.replace('/cosmoshub/dashboard');
    }
  }, [chain, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}

export const getStaticProps = async () => {
  return {
    props: {},
  };
};
