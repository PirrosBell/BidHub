#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo " Setting up Auction Project..."

# Check for Python
if ! command_exists python3; then
    echo " Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check for Node.js
if ! command_exists node; then
    echo " Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

# Check for pip
if ! command_exists pip3; then
    echo " pip3 is not installed. Please install pip3."
    exit 1
fi

# Create and activate virtual environment
echo " Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo " Installing Python dependencies..."
pip install -r requirements.txt

echo "Making migrations"
python auction/manage.py makemigrations bids authentication

# Apply database migrations
echo " Setting up database..."
python auction/manage.py migrate

# Create superuser if not exists
echo " Creating superuser (if needed)..."
python auction/manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin', 'admin@example.com', 'admin')"

# Install frontend dependencies
echo " Installing frontend dependencies..."
cd frontend
npm install

# Build frontend
echo "🏗️ Building frontend..."
npm run build

cd ..

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p media/item_images

echo "✅ Setup completed!"
echo ""
echo "To run the project:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Start backend server: python manage.py runserver"
echo "3. In another terminal, go to frontend directory and run: npm run dev"
echo ""
echo "Default superuser credentials:"
echo "Username: admin"
echo "Password: admin"
echo ""
echo "🌟 Visit http://localhost:5173 to access the application"