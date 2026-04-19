import FloatingPillNav from '@/components/navigation/FloatingPillNav';
import Footer from '@/components/navigation/Footer';

export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FloatingPillNav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
