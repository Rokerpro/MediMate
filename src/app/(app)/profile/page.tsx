import { AccountDeletion } from "@/components/account-deletion";
import { ProfileForm } from "@/components/profile-form";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm font-medium text-blue-700">Personal profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-2 text-slate-600">
          Keep this synthetic information current for the demo experience.
        </p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <ProfileForm />
      </section>
      <AccountDeletion />
    </div>
  );
}
