export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-4xl font-black">
          Delete Your CrewCall Account
        </h1>

        <p className="mt-6 text-slate-300">
          To request deletion of your CrewCall account and associated data,
          email:
        </p>

        <p className="mt-3 text-xl font-bold text-cyan-300">
          support@crewcall.app
        </p>

        <h2 className="mt-8 text-2xl font-black">
          Information Deleted
        </h2>

        <p className="mt-3 text-slate-300">
          We will delete account information, profile information, uploaded
          files, applications, and associated user data upon request.
        </p>

        <h2 className="mt-8 text-2xl font-black">
          Information That May Be Retained
        </h2>

        <p className="mt-3 text-slate-300">
          Some information may be retained when required for legal, financial,
          fraud prevention, or transaction record requirements.
        </p>

        <h2 className="mt-8 text-2xl font-black">
          Request Process
        </h2>

        <p className="mt-3 text-slate-300">
          Send a request from the email address associated with your account.
          We will verify ownership and process the request.
        </p>
      </div>
    </main>
  )
}
