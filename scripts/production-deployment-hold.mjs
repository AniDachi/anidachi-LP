// Vercel ignoreCommand: zero cancels the build, one continues it.
// External promotions/queued deployments also need the operator Vercel freeze.
const held =
	process.env.VERCEL_ENV === "production" ||
	process.env.VERCEL_GIT_COMMIT_REF === "main";
console.log(
	held
		? "Production held: coordinated database transition required."
		: "Staging/preview build continues.",
);
process.exit(held ? 0 : 1);
