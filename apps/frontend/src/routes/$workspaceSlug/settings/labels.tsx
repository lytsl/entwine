import { Button } from "@entwine/ui/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@entwine/ui/components/ui/empty";
import { toast } from "@entwine/ui/components/ui/toast";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, TagIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useStore } from "../../../hooks/use-store";
import { LabelForm } from "./-components/label-form";
import { LabelRow } from "./-components/label-row";

export const Route = createFileRoute("/$workspaceSlug/settings/labels")({ component: LabelsPage });

function LabelsPage() {
  const store = useStore();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHeader title="Labels" icon={<TagIcon />} count={store.labels.sorted.length}>
        <Button size="sm" className="h-7 text-body" onClick={() => setAdding(true)}>
          <PlusIcon />
          New label
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-10">
          <div className="flex flex-col gap-1 border-b pb-3">
            <h2 className="text-base font-semibold">Labels</h2>
            <p className="text-body text-muted-foreground">
              Labels are shared by every project of the workspace. Names are unique, ignoring case.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card/40">
            {adding && (
              <LabelForm
                submitLabel="Create"
                onCancel={() => setAdding(false)}
                onSubmit={(name, color) => {
                  if (store.labels.find(name)) {
                    toast.error(`Label ${name} already exists`);
                    return false;
                  }
                  store.labels.create(name, color);
                  return true;
                }}
              />
            )}
            {store.labels.sorted.length === 0 && !adding ? (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <TagIcon />
                  </EmptyMedia>
                  <EmptyTitle>No labels yet</EmptyTitle>
                  <EmptyDescription>Labels group issues across projects, such as Bug or Docs.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul aria-label="Labels" className="-mb-px">
                {store.labels.sorted.map((label) => (
                  <LabelRow key={label.id} label={label} uses={store.issues.labelUses(label.id)} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
