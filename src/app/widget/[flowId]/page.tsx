import { WidgetChat } from "@/components/chatbots/widget-chat";

export const dynamic = "force-dynamic";

/** Public, standalone page that runs a chatbot flow live (web chat). */
export default async function WidgetPage({ params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = await params;
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="h-[600px] w-full max-w-md">
        <WidgetChat flowId={flowId} />
      </div>
    </div>
  );
}
