-- Storage bucket for walk photos.
-- Public-read: report-card links are unlisted (token-gated) rather than
-- access-controlled, so a public bucket keeps <img> tags simple. Revisit if
-- photo privacy needs to be stronger than "unguessable link" later.

insert into storage.buckets (id, name, public)
values ('walk-photos', 'walk-photos', true)
on conflict (id) do nothing;

create policy "yaya can upload walk photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'walk-photos' and is_admin());

create policy "yaya can manage walk photos"
on storage.objects for all to authenticated
using (bucket_id = 'walk-photos' and is_admin());

create policy "anyone can view walk photos"
on storage.objects for select to anon
using (bucket_id = 'walk-photos');
