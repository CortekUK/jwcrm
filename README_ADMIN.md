# Setting Up Admin Access

By default, all new users are assigned the `client` role. To grant a user admin access:

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/gyikimtqsasryewwawgs
2. Navigate to the SQL Editor
3. Run the following SQL query, replacing `USER_ID_HERE` with the actual user ID:

```sql
UPDATE profiles
SET role = 'admin'
WHERE user_id = 'USER_ID_HERE';
```

To find a user's ID:
1. Go to Authentication > Users in your Supabase dashboard
2. Find the user in the list
3. Copy their UUID from the `id` column

Once updated, the user will be automatically redirected to `/admin` on their next login.

## Testing

You can disable email confirmation in Supabase to speed up testing:
1. Go to Authentication > Settings
2. Disable "Enable email confirmations"
3. This allows immediate login after signup (development only)
