
-- Create storage bucket for knowledge base files
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-files', 'knowledge-files', false);

-- Storage policies
CREATE POLICY "Clients can upload own knowledge files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'knowledge-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Clients can view own knowledge files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'knowledge-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Clients can delete own knowledge files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'knowledge-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can manage all knowledge files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'knowledge-files' AND 
    public.has_role(auth.uid(), 'admin')
  );
