import BroadcastComposer from "@/components/admin/BroadcastComposer";

export const dynamic = "force-dynamic";

export default function BroadcastPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1">Email your list</h1>
      <p className="text-sm text-[#71717A] mb-8">
        Reach your subscribers or leads. Every send carries a one-click unsubscribe, and anyone who opted out is always skipped.
      </p>
      <BroadcastComposer />
    </div>
  );
}
