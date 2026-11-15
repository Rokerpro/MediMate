import { PageHeader } from "@/components/page-header";
import { AccountDeletion } from "@/components/account-deletion";
import { ProfileForm } from "@/components/profile-form";
import { SignOutButton } from "@/components/sign-out-button";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Personal profile"
        title="Your profile"
      />
      <section className="rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-5 shadow-sm sm:p-8">
        <ProfileForm />
      </section>
      <section
        aria-labelledby="account-actions-heading"
        className="flex flex-col gap-4 rounded-2xl border border-[#dfe3d6] bg-[#fffdf8] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div>
          <h2 id="account-actions-heading" className="text-lg font-semibold text-[#243b30]">
            Account
          </h2>
        </div>
        <SignOutButton />
      </section>
      <AccountDeletion />
    </div>
  );
}
