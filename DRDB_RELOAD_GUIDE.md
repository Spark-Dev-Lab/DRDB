# DRDB Reload Guide (This Host)

Use this guide after making DRDB code changes.

## Frontend Changes

1. Build frontend assets:

   cd /opt/drdb/client
   npm run build

2. Hard refresh browser:

   Cmd+Shift+R

Notes:
- Frontend is served from /opt/drdb/client/dist.
- No nginx reload step is required in your current workflow.

## Backend Changes

1. Restart backend LaunchDaemon:

   sudo launchctl kickstart -k system/edu.sparklab.drdb.backend

2. Check service state:

   launchctl print system/edu.sparklab.drdb.backend | grep "state =\|pid =\|last exit code"

3. Confirm node worker:

   ps aux | grep '[n]ode server.js'

## If Backend Kickstart Does Not Rotate Cleanly

1. Full daemon reload:

   sudo launchctl bootout system /Library/LaunchDaemons/edu.sparklab.drdb-backend.plist
   sudo launchctl bootstrap system /Library/LaunchDaemons/edu.sparklab.drdb-backend.plist

2. Re-check state:

   launchctl print system/edu.sparklab.drdb.backend | grep "state =\|pid =\|last exit code"

## Label Discovery

If labels ever differ, list DRDB system jobs:

sudo launchctl print system | grep -i drdb
