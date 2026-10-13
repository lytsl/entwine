import { toast } from "@entwine/ui/components/ui/toast";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import { PageHeader } from "../../../../components/page-header";
import { ProjectCrumb } from "../../../../components/project-crumb";
import { useStore } from "../../../../hooks/use-store";
import { ProjectArchivedBanner } from "../../-components/project/project-archived-banner";
import { ProjectForm } from "../../-components/project/project-form";
import { SettingsSection } from "../../-components/settings/settings-section";
import { IssueScope } from "../../-components/workspace/issue-scope";
import { CycleScheduleForm } from "./-components/settings/cycle-schedule-form";
import { DangerZone } from "./-components/settings/danger-zone";
import { StatesEditor } from "./-components/settings/states-editor";

export const Route = createFileRoute("/$workspaceSlug/projects/$projectId/settings")({ component: ScopedPage });

function ProjectSettings() {
  const { projectId } = Route.useParams();
  const store = useStore();
  const project = store.projects.get(projectId);
  if (!project) return <PageHeader title="Project not found" />;
  return (
    <>
      <PageHeader
        title="Settings"
        icon={<SettingsIcon />}
        crumbs={[<ProjectCrumb key="project" project={project} to="settings" />]}
      />
      <ProjectArchivedBanner project={project} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-10">
          <SettingsSection
            title="General"
            description="The project's name, the identifier its issue keys start with, and what it is for."
          >
            <div className="rounded-xl border bg-card/40 p-5">
              <ProjectForm key={project.id} project={project} onSaved={() => toast.success("Project saved")} />
            </div>
          </SettingsSection>
          <SettingsSection
            title="States"
            description="Issues move through these states, group by group. Drag a state to reorder it or to move it to another group."
          >
            <StatesEditor project={project} store={store} />
          </SettingsSection>
          <SettingsSection
            title="Cycles"
            description="Leave cycles to a schedule: the next ones are created ahead of time, beside any you make by hand."
          >
            <CycleScheduleForm
              key={[project.cycleWeeks, project.cycleStartDay, project.cycleUpcoming, project.cycleRollover].join()}
              project={project}
              store={store}
            />
          </SettingsSection>
          <SettingsSection title="Danger zone">
            <DangerZone project={project} store={store} />
          </SettingsSection>
        </div>
      </div>
    </>
  );
}

function ScopedPage() {
  return (
    <IssueScope scope={{ projectId: Route.useParams().projectId }}>
      <ProjectSettings />
    </IssueScope>
  );
}
