import { BookOpen, Plus, FileText } from "lucide-react";
import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { formatDistanceToNowStrict } from "date-fns";

interface Article {
  id: string; title: string; status: string; index_status: string;
  source_type: string; updated_at: string;
}

export default async function KnowledgePage() {
  const { org } = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_articles")
    .select("id, title, status, index_status, source_type, updated_at")
    .eq("organisation_id", org.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  const articles = (data ?? []) as unknown as Article[];

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader
        title="Knowledge Base"
        description="Source material your AI agents draw from — articles, FAQs and documents."
        actions={<Button size="sm"><Plus className="size-4" /> New article</Button>}
      />
      <div className="mt-6 overflow-hidden rounded-[12px] border border-border bg-card">
        {articles.length === 0 ? (
          <div className="p-6"><EmptyState icon={BookOpen} title="No articles yet" description="Write an article or upload a document to build your knowledge base." /></div>
        ) : (
          <ul className="divide-y divide-border">
            {articles.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <FileText className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate text-sm font-medium">{a.title}</span>
                <Badge variant="outline">{a.source_type}</Badge>
                <Badge variant={a.index_status === "indexed" ? "success" : "muted"}>{a.index_status}</Badge>
                <Badge variant={a.status === "published" ? "primary" : "muted"}>{a.status}</Badge>
                <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{formatDistanceToNowStrict(new Date(a.updated_at))} ago</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{articles.length} articles. Document upload, chunk preview and re-indexing are part of the knowledge build-out.</p>
    </div>
  );
}
