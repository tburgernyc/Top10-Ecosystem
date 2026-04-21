import FloatingPillNav from '@/components/navigation/FloatingPillNav';
import Footer from '@/components/navigation/Footer';
import BlurredVideoBackground from '@/components/ui/BlurredVideoBackground';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BlurredVideoBackground />
      <FloatingPillNav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
