-- Add DELETE policy for quiz_scores so admins can remove scores
CREATE POLICY "Admins can delete quiz scores"
ON public.quiz_scores
FOR DELETE
USING (can_manage_organization(auth.uid(), organization_id));