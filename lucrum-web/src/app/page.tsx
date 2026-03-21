import { Header } from "@/components/landing/header";
import { HeroSection } from "@/components/landing/hero";
import { StrategyShowcase } from "@/components/landing/strategy-showcase";
import { FeaturesSection } from "@/components/landing/features";
import { CTASection } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-void">
      <Header />
      <HeroSection />
      <StrategyShowcase />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </main>
  );
}
