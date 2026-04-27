import FloatingPillNav from '@/components/navigation/FloatingPillNav';
import Footer from '@/components/navigation/Footer';
import AccountSignOutButton from '@/components/account/AccountSignOutButton';
import { requireCustomerSession } from '@/lib/auth';

export const metadata = { title: 'My Account', robots: { index: false, follow: false } };

export const dynamic = 'force-dynamic';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireCustomerSession();

  return (
    <>
      <FloatingPillNav />
      <main style={{ minHeight: '100dvh', paddingTop: '6rem', paddingBottom: '4rem' }}>
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '0 1.5rem',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <AccountSignOutButton />
        </div>
        {children}
      </main>
      <Footer />
    </>
  );
}
