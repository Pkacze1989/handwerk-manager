import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { updateInstruction } from "@/actions/projects";
import { Card } from "@/components/ui";
import { formatDate } from "@/lib/format";

export default async function SiteTasksPage() {
  const user = await requireUser();
  const instructions = await prisma.workInstruction.findMany({
    where: { assigneeId: user.id },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Aufgaben</h1>
      {instructions.map((instruction) => {
        const materials = JSON.parse(instruction.materials || "[]") as { text: string; done: boolean }[];
        return (
          <Card key={instruction.id}>
            <p className="text-xs text-muted">{instruction.project.title}{instruction.dueDate ? ` · bis ${formatDate(instruction.dueDate)}` : ""}</p>
            <h2 className="font-serif text-2xl">{instruction.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm">{instruction.body}</p>
            <ul className="mt-3 space-y-2">
              {materials.map((item, index) => (
                <li key={item.text}>
                  <form action={updateInstruction}>
                    <input type="hidden" name="id" value={instruction.id} />
                    <input type="hidden" name="back" value="/baustelle/anweisungen" />
                    <input type="hidden" name="status" value={instruction.status} />
                    <input type="hidden" name="doneIndex" value={index} />
                    <input type="hidden" name="done" value={item.done ? "0" : "1"} />
                    <button className="text-left text-sm">{item.done ? "☑" : "☐"} {item.text}</button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={updateInstruction} className="mt-3">
              <input type="hidden" name="id" value={instruction.id} />
              <input type="hidden" name="back" value="/baustelle/anweisungen" />
              <input type="hidden" name="status" value={instruction.status === "ERLEDIGT" ? "OFFEN" : "ERLEDIGT"} />
              <button className="rounded-full bg-spruce px-3 py-1.5 text-sm font-semibold text-white">
                {instruction.status === "ERLEDIGT" ? "Wieder öffnen" : "Erledigt"}
              </button>
            </form>
          </Card>
        );
      })}
    </div>
  );
}
