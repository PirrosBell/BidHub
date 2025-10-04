# BidHub
## Run Instructions

This project can be run on a Linux machine by following the steps below. On Windows, creating the Python virtual environment (venv) is different. Note that the database is not included in the project files (due to size), so some features may not work or may not be accurate.

Inside the project folder, run the setup.sh file (give it execution permissions with chmod +x if it doesn’t already have them).

Open two separate terminals — one for running the backend and one for the frontend.

Backend:
  1. source venv/bin/activate
  2. cd auction/
  3. python manage.py runserver

Frontend: 
  1. cd frontend/
  2. npm run dev
  3. In the console that appears, press o and then Enter
