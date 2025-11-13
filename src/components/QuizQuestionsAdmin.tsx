import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QuizQuestion {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  created_at: string;
}

interface QuizQuestionsAdminProps {
  organizationId: string | null;
}

export default function QuizQuestionsAdmin({ organizationId }: QuizQuestionsAdminProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuizQuestion | null>(null);
  const [form, setForm] = useState({ question: "", answer: "" });
  const { toast } = useToast();

  useEffect(() => {
    if (organizationId) loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const loadQuestions = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("training_questions")
        .select("id, question, answer, display_order, created_at")
        .eq("organization_id", organizationId)
        .is("module_id", null)
        .is("section_id", null)
        .order("display_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setQuestions(data || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load quiz questions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ question: "", answer: "" });
    setDialogOpen(true);
  };

  const openEdit = (q: QuizQuestion) => {
    setEditing(q);
    setForm({ question: q.question, answer: q.answer });
    setDialogOpen(true);
  };

  const saveQuestion = async () => {
    if (!organizationId) return;
    try {
      if (!form.question.trim() || !form.answer.trim()) {
        toast({ title: "Missing fields", description: "Please fill question and answer", variant: "destructive" });
        return;
      }
      if (editing) {
        const { error } = await (supabase as any)
          .from("training_questions")
          .update({ question: form.question.trim(), answer: form.answer.trim() })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Question updated" });
      } else {
        const nextOrder = (questions[questions.length - 1]?.display_order ?? 0) + 1;
        const { error } = await (supabase as any)
          .from("training_questions")
          .insert({
            organization_id: organizationId,
            question: form.question.trim(),
            answer: form.answer.trim(),
            display_order: nextOrder,
            module_id: null,
            section_id: null,
          });
        if (error) throw error;
        toast({ title: "Question added" });
      }
      setDialogOpen(false);
      setEditing(null);
      setForm({ question: "", answer: "" });
      loadQuestions();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Could not save question", variant: "destructive" });
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      const { error } = await (supabase as any)
        .from("training_questions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Question deleted" });
      loadQuestions();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Could not delete question", variant: "destructive" });
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Quiz Questions</CardTitle>
          <CardDescription>Manage flashcards used in Quiz Mode</CardDescription>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="text-sm text-muted-foreground">No questions yet. Click "Add Question" to create one.</div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {questions.map((q, idx) => (
              <div key={q.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">#{idx + 1}</div>
                  <p className="text-sm font-medium truncate">{q.question}</p>
                  <p className="text-xs text-muted-foreground truncate mt-1">{q.answer}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(q)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteQuestion(q.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Question" : "Add Question"}</DialogTitle>
            <DialogDescription>Only managers/admins can edit quiz questions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Question</Label>
              <Textarea
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="Type the quiz question"
              />
            </div>
            <div>
              <Label>Answer</Label>
              <Textarea
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                placeholder="Type the correct answer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveQuestion}>{editing ? "Save Changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
