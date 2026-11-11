-- Runs automatically on first container startup (docker-entrypoint-initdb.d).
-- Creates both logical databases the backend needs: the control-plane
-- registry and the shared database that holds every tenant's schema.
CREATE DATABASE hms_control;
CREATE DATABASE hms_tenants;
