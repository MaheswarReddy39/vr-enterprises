/** Branded loading state used while a page or admin area is being fetched. */
export function PageLoader() {
  return (
    <div role="status" className="grid min-h-[40vh] place-items-center p-12">
      <div className="flex flex-col items-center gap-4">
        <img src="/brand/logo-mark.svg" alt="" className="float-slow size-12" />
        <span className="text-sm font-medium text-muted">Loading...</span>
      </div>
    </div>
  );
}
