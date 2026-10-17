# Adapters
Implement the SAD storage (`put`, `get`, `remove`) and mail (`sendResetLink`) interfaces here in the corresponding feature PRs. No real email service or file persistence is provided by the foundation. Uploads use the agreed Docker volume; future implementation must keep private files behind authorised API access, never a public static directory.
