import { useEffect } from "react";
import { useRouter } from "next/router";
import { useChains } from "@/context/ChainsContext";

export default function Home() {
  const router = useRouter();
  const { chain } = useChains();

  useEffect(() => {
    // On a cold load the chain context is still emptyChain (registryName ""), so this
    // effect runs before the chain resolves. Fall back to the deployment's configured
    // chain instead of a hardcoded one, or a first visit lands on the wrong network.
    const registryName =
      chain?.registryName || process.env.NEXT_PUBLIC_REGISTRY_NAME || "cosmoshub";
    router.replace(`/${registryName}/dashboard`);
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
