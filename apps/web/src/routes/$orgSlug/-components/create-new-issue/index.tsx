import { EditIcon, Heart } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { type Issue, ranks } from "@/mock-data/issues";
import { priorities } from "@/mock-data/priorities";
import { status } from "@/mock-data/status";
import { useCreateIssueStore } from "@/store/create-issue-store";
import { useIssuesStore } from "@/store/issues-store";
import { AssigneeSelector } from "./assignee-selector";
import { LabelSelector } from "./label-selector";
import { PrioritySelector } from "./priority-selector";
import { ProjectSelector } from "./project-selector";
import { StatusSelector } from "./status-selector";
import { useOrgRoutContext } from "@/routes/$orgSlug/layout";
import { useLiveQuery, useLiveSuspenseQuery } from "@tanstack/react-db";
import { Selector } from "./selector";

export function CreateNewIssue() {
  const { collections } = useOrgRoutContext();
  const issueStatusQuery = useLiveSuspenseQuery((q) =>
    q.from({ IssueStatus: collections.IssueStatus }),
  );

  const [createMore, setCreateMore] = useState<boolean>(false);
  const { isOpen, defaultStatus, openModal, closeModal } =
    useCreateIssueStore();
  const { addIssue, getAllIssues } = useIssuesStore();

  const generateUniqueIdentifier = useCallback(() => {
    const identifiers = getAllIssues().map((issue) => issue.identifier);
    let identifier = Math.floor(Math.random() * 999)
      .toString()
      .padStart(3, "0");
    while (identifiers.includes(`LNUI-${identifier}`)) {
      identifier = Math.floor(Math.random() * 999)
        .toString()
        .padStart(3, "0");
    }
    return identifier;
  }, [getAllIssues]);

  const createDefaultData = useCallback((): Issue => {
    return {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      statusId: issueStatusQuery.data[0].id,
      assigneeId: null,
      priority: 0,
      labels: [],
      createdAt: new Date(),
      projectId: null,
      rank: ranks[ranks.length - 1],
      parentId: null,
      teamId: "1",
      teamNumber: 1,
      updatedAt: new Date(),
      dueDate: null,
    };
  }, [issueStatusQuery.data]);

  const [addIssueForm, setAddIssueForm] = useState<Issue>(createDefaultData());

  useEffect(() => {
    setAddIssueForm(createDefaultData());
  }, [createDefaultData]);

  const createIssue = () => {
    if (!addIssueForm.title) {
      toast.error("Title is required");
      return;
    }
    toast.success("Issue created");
    addIssue(addIssueForm);
    collections.Issue.insert({
      ...addIssueForm,
      // statusId: issueStatusQuery.data[0]!.id,
      parentId: null,
      teamId: "1",
      projectId: null,
      assigneeId: null,
      teamNumber: 1,
      updatedAt: new Date(),
      createdAt: new Date(),
      dueDate: null,
      labels: [],
      priority: 0,
    });
    if (!createMore) {
      closeModal();
    }
    setAddIssueForm(createDefaultData());
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(value) => (value ? openModal() : closeModal())}
    >
      <DialogTrigger
        render={
          <Button className="size-8 shrink-0" variant="secondary" size="icon" />
        }
      >
        <EditIcon />
      </DialogTrigger>
      <DialogContent className="top-[30%] w-full p-0 shadow-xl sm:max-w-[750px]">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2 px-4 pt-4">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Heart className="size-4 fill-orange-500 text-orange-500" />
                <span className="font-medium">CORE</span>
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="w-full space-y-3 px-4 pb-0">
          <Input
            className="h-auto w-full overflow-hidden text-ellipsis whitespace-normal break-words border-none px-0 font-medium text-2xl shadow-none outline-none focus-visible:ring-0"
            placeholder="Issue title"
            value={addIssueForm.title}
            onChange={(e) =>
              setAddIssueForm({ ...addIssueForm, title: e.target.value })
            }
          />

          <Textarea
            className="overflow-wrap min-h-16 w-full resize-none whitespace-normal break-words border-none px-0 shadow-none outline-none focus-visible:ring-0"
            placeholder="Add description..."
            value={addIssueForm.description}
            onChange={(e) =>
              setAddIssueForm({ ...addIssueForm, description: e.target.value })
            }
          />

          <div className="flex w-full flex-wrap items-center justify-start gap-1.5">
            <Selector
              value={addIssueForm.statusId}
              onChange={({ id }) =>
                setAddIssueForm({ ...addIssueForm, statusId: id })
              }
              options={issueStatusQuery.data}
            />
            {/*<PrioritySelector
              priority={addIssueForm.priority}
              onChange={(newPriority) =>
                setAddIssueForm({ ...addIssueForm, priority: newPriority })
              }
            />
            <AssigneeSelector
              assignee={addIssueForm.assignee}
              onChange={(newAssignee) =>
                setAddIssueForm({ ...addIssueForm, assignee: newAssignee })
              }
            />
            <ProjectSelector
              project={addIssueForm.project}
              onChange={(newProject) =>
                setAddIssueForm({ ...addIssueForm, project: newProject })
              }
            />
            <LabelSelector
              selectedLabels={addIssueForm.labels}
              onChange={(newLabels) =>
                setAddIssueForm({ ...addIssueForm, labels: newLabels })
              }
            />*/}
          </div>
        </div>
        <div className="flex w-full items-center justify-between border-t px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="create-more"
                checked={createMore}
                onCheckedChange={setCreateMore}
              />
              <Label htmlFor="create-more">Create more</Label>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              createIssue();
            }}
          >
            Create issue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
