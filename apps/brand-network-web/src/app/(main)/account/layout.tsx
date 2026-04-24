import FloatingPillNav from '@/components/navigation/FloatingPillNav';
import Footer from '@/components/navigation/Footer';
import { requireCustomerSession } from '@/lib/auth';

export const metadata = { title: 'My Account', robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireCustomerSession();

  return (
    <>
      <FloatingPillNav />
      <main style={{ minHeight: '100dvh', paddingTop: '6rem', paddingBottom: '4rem' }}>
        {children}
      </main>
      <Footer />
    </>
  );
}
