import numpy as np
from django.contrib.auth import get_user_model
from bids.models import Item
from django.utils import timezone

ROOT_PATH = '/home/duck/project_auction/auction_backend/auction/'

User = get_user_model()


def generate_recommendations(user, ending_soon=False):
    # Get user id 
    user_id = user.id

    ratings = []

    # Load the metrices
    item_vectors = np.load(ROOT_PATH + '/data/latent_vectors/items.npy')
    user_vectors = np.load(ROOT_PATH + '/data/latent_vectors/users.npy')

    user_index = user.profile.index
    # except (AttributeError, TypeError) as e:
    #     raise ValueError("User has no recommendation data available yet. Try viewing or bidding on some items first.")

    # Get user vector
    user_vector = user_vectors[user.profile.index]

    # Get active item indices
    items = Item.objects.filter(status='active', index__isnull=False
                        ).exclude(seller__userID=user.id)
    
    # if ending_soon:
    #     now = timezone.now()
    #     tomorrow = now + timezone.timedelta(days=1)
    #     items.filter(
    #         ends_lte=tomorrow,
    #         ends_gte=now,
    #     )

    print(len(items))

    # For each item, calculate rating and append to list
    for item in items:
        try:
            rating = np.dot(item_vectors[item.index], user_vector)
            ratings.append((rating, item))
        except:
            print(item.index, " does not work FOR SOME FUCKING REASON")

    # Sort by rating in descending order (highest first)
    ratings.sort(key=lambda x: x[0], reverse=True)
    
    # Return just the items in sorted order
    return [item for _, item in ratings]