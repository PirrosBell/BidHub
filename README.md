# BidHub
## Run Instructions

This project can be run on a Linux machine by following the steps below. On Windows, creating the Python virtual environment (venv) is different. Note that the database is not included in the project files (due to size), so some features may not work or may not be accurate.

Inside the project_auction_2000141_19000109 folder, run the setup.sh file (give it execution permissions with chmod +x if it doesn’t already have them).

Open two separate terminals — one for running the backend and one for the frontend.

Backend:
a. source venv/bin/activate
b. cd auction/
c. python manage.py runserver

Frontend:
a. cd frontend/
b. npm run dev
c. In the console that appears, press o and then Enter
