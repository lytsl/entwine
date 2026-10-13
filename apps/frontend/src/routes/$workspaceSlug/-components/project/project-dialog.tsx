import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@entwine/ui/components/ui/dialog";
import { ProjectForm } from "./project-form";

export function ProjectDialog({ onClose }: { onClose(): void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <ProjectIcon project={{ id: "new", identifier: "+" }} size={28} />
          </div>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Issues in the project are keyed by its identifier, such as WEB-12. Every member can see it.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm onSaved={onClose} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}
