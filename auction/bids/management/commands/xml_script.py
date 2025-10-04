import os
import xml.etree.ElementTree as ET
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model 
from django.contrib.auth.hashers import make_password
from datetime import datetime
from django.utils import timezone
from bids.models import (
    Item, Seller, Bidder, Location, Bid,
    Category 
    )
from django_countries.fields import CountryField 
import pycountry
import random
import time
User = get_user_model()

bidders = {}
locations = {}
users = {}
categories = {}

simple_password = make_password('password123')  # Default password for all users

def parse_number(value: str) -> float:
    """
    Converts a string like '1,000.00' to a float 1000.00.
    Removes commas and strips whitespace.
    
    Raises ValueError if conversion is not possible.
    """

    clean_value = value.replace(',', '').strip()
    return float(clean_value)

def create_afm():
    num1 = 100000000 * (random.random() % 9 + 1) 
    num2 = random.random() % 100000000
    return num1 + num2


def get_or_create_user_seller(userID):
    """
    Create a User instance from a userID string.
    """
    username = userID.lower()
    if username in users:
        return users[username]
    email = f"{username}@example.com"
    user = User.objects.create(username=username, email=email)
    user.password = simple_password  # Set a default password
    user.save()
    user.profile.afm = create_afm()
    seller = create_seller(user)
    users[username] = (user, seller)

    return user, seller

def create_seller(user):
    """
    Create a Seller instance from a User instance.
    """
    seller = Seller.objects.create(userID=user,
                                                   avg_rating=0.0, rating_count=0)
    return seller

def parse_country(country_name):
    try:
        return pycountry.countries.lookup(country_name).alpha_2
    except LookupError:
        return pycountry.countries.lookup('United States').alpha_2  # Default to US if not found

def get_or_create_bidder(user, country, location):
    """
    Create a Bidder instance from a User instance, country, and location.
    """
    if user.username in bidders:
        return bidders[user.username]
    bidder = Bidder.objects.create(userID=user,
                                    country=country, location=location,
                                    rating_count=0, avg_rating=0.0)
    bidders[user.username] = bidder
    return bidder

def get_or_create_location(address, longitude=None, latitude=None):
    """
    Create a Location instance from an address, longitude, and latitude.
    """
    if (address, longitude, latitude) in locations:
        return locations[(address, longitude, latitude)]
    location = Location.objects.create(address=address, longitude=longitude, latitude=latitude)
    locations[(address, longitude, latitude)] = location
    return location

def get_or_create_category(name):
    """
    Create a Category instance from a name.
    """
    if name in categories:
        return categories[name]
    try: 
        category = Category.objects.create(name=name)
    except Exception as e:
        print(f"Error creating category '{name}': {e}")
        print(categories)
    categories[name] = category
    return category

def green(msg):
    return f"\033[92m{msg}\033[0m"


class Command(BaseCommand):
    help = "Import items and related data from XML files"

    def add_arguments(self, parser):
        parser.add_argument(
            'xml_paths',
            nargs='+',  
            type=str,
            help='One or more paths to XML files'
        )

    def handle(self, *args, **options):
        xml_paths = options['xml_paths']
        print(xml_paths)

        for path in xml_paths:
            if not os.path.exists(path):
                self.stderr.write(self.style.ERROR(f"File not found: {path}"))
                continue
            self.stdout.write(self.style.SUCCESS(f"Processing: {path}"))
            start_time = time.time()
            self.process_file(path)
            end_time = time.time()
            self.stdout.write(self.style.SUCCESS(green(f"Processing time: {end_time - start_time} seconds")))
       
        new_york = get_or_create_location('New York')
        us_country = parse_country("United States")
        for username in users:
            if username not in bidders:
                bidder = get_or_create_bidder(users[username][0], us_country, new_york)


    def process_file(self, xml_path):
        tree = ET.parse(xml_path)
        root = tree.getroot()
        count = 0

        for item_elem in root.findall('Item'):

            name = item_elem.findtext('Name')


            item_categories = []
            for category_elem in item_elem.findall('Category'):
                category_name = category_elem.text
                category = get_or_create_category(category_name)
                item_categories.append(category)

            current_bid = parse_number(item_elem.findtext('Currently')[1:])
            first_bid = parse_number(item_elem.findtext('First_Bid')[1:])
            started = datetime.strptime(item_elem.findtext('Started'), "%b-%d-%y %H:%M:%S")
            started = timezone.make_aware(started.replace(year=2024))
            ends = datetime.strptime(item_elem.findtext('Ends'), "%b-%d-%y %H:%M:%S")
            ends = timezone.make_aware(ends.replace(year=2026))
            country = item_elem.findtext('Country')

            buy_price_elem = item_elem.find('Buy_Price')
            buy_price = None
            if buy_price_elem is not None:
                buy_price = parse_number((buy_price_elem.text[1:]))

            country = parse_country(country)

            location_elem = item_elem.find('Location')
            location = get_or_create_location(
                location_elem.text,
                longitude=float(location_elem.get('Longitude')) if location_elem.get('Longitude') else None,
                latitude=float(location_elem.get('Latitude')) if location_elem.get('Latitude') else None
            )


            user, seller = get_or_create_user_seller(item_elem.find('Seller').get('UserID'))

            item = Item.objects.create(
                name=name,
                current_bid=current_bid,
                first_bid=first_bid,
                started=started,
                ends=ends,
                country=country,
                location=location,
                seller=seller,
                description=item_elem.findtext('Description'),
                buy_price=buy_price,
                status='active',
            )

            item.categories.set(item_categories)
            item.save()

            num_of_bids = 0

            for bid_elem in item_elem.findall('Bids/Bid'):
                bidder_user, _ = get_or_create_user_seller(bid_elem.find('Bidder').get('UserID'))
                country = parse_country(bid_elem.find('Bidder').findtext('Country'))
                location_address = bid_elem.find('Bidder').findtext('Location')

                try:
                    location = get_or_create_location(location_address)
                except Exception as e:
                    print(f"Location not set, will default to New York")
                    location = get_or_create_location("New York")

                bidder = get_or_create_bidder(bidder_user, country, location)
                bid_amount = parse_number(bid_elem.findtext('Amount')[1:])
                Bid.objects.create(item=item, bidder=bidder, amount=bid_amount)
                num_of_bids += 1

            item.number_of_bids = num_of_bids
            item.save()
            count =  count + 1
            print(count)
        self.stdout.write(self.style.SUCCESS(f"Imported {count} items from {xml_path}"))

