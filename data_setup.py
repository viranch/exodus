import os,shutil

cache_dir = '/tmp/swaks'

if not os.path.exists(cache_dir):
    os.makedirs(cache_dir)

metacache_db = 'script.exodus.metadata_meta.db'
dest = os.path.join(cache_dir, metacache_db)

if not os.path.exists(dest):
    src = os.path.join(os.path.dirname(__file__), 'data', metacache_db)
    shutil.copyfile(src, dest)
