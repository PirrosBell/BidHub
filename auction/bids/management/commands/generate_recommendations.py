import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from collections import defaultdict
from authentication.models import UserProfile
from bids.models import (
    Bid, Visited, Bidder, Item
    )
import numpy as np
from bids.utils import generate_recommendations
from sklearn.model_selection import train_test_split 

ROOT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))


np.set_printoptions(threshold=np.inf)  # Don't truncate any output

User = get_user_model()

def map_to_str(num):
    if num == 0:
        return ""
    return str(num) + " "

class Command(BaseCommand):
    help = 'Generate recommendations for users based on their activity using matrix factorization.'

    def handle(self, *args, **options):
        matrix, user_indexes, item_indexes = self.extract_data()
        print(f"Len of usr_indx: ${len(user_indexes)}\nLen of item_indx: ${len(item_indexes)}")
        user_vectors, item_vectors = self.train_model(matrix, user_indexes, item_indexes)
        print(f"Len of usr: $ {user_vectors.shape}")
        print(f"Len of items: ${item_vectors.shape}")
        self.save_matrices(user_vectors, item_vectors)

        ## TESTING GENERATE RECOMMENDATIONS FUNCTION -- DELETE LATERRRRRRR
        index = 0

        recommendations = generate_recommendations(User.objects.get(profile__index=index))

        for index in range(50):
            print(f'Recommendation {index}: {recommendations[index]}')
        print('Done')
        pass

    def extract_data(self):
        print("Extracting data...")

        # Only get visits and bids for non-canceled items
        active_items = Item.objects.exclude(status='canceled')
        active_item_ids = set(active_items.values_list('id', flat=True))
        
        visits = Visited.objects.filter(item_id__in=active_item_ids).values_list('bidder__userID_id', 'item_id')
        bids = Bid.objects.filter(item_id__in=active_item_ids).values_list('bidder__userID_id', 'item_id', 'amount')

        print(f"Processing {len(visits)} visits and {len(bids)} bids...")

        users = User.objects.all()
        items = Item.objects.exclude(status='canceled')

        user_ids = list(users.values_list('id', flat=True).order_by('id'))
        item_ids = list(items.values_list('id', flat=True).order_by('id'))

        # Storing indices of items and users to be able to calculate recommendations 
        user_index = {uid: idx for idx, uid in enumerate(user_ids)}
        item_index = {iid: idx for idx, iid in enumerate(item_ids)}

        profiles = []

        for user in users:
            user.profile.index = user_index[user.id]
            profiles.append(user.profile)

        for item in items:
            item.index = item_index[item.id]
            
        UserProfile.objects.bulk_update(profiles, ['index'])
        Item.objects.bulk_update(items, ['index'])

        matrix = np.zeros((len(user_ids), len(item_ids)), dtype=np.float64)

        # First go through bids
        for user_id, item_id, _ in bids:
            matrix[user_index[user_id], item_index[item_id]] += 3 

        # Then go through visits
        for user_id, item_id in visits:
            matrix[user_index[user_id], item_index[item_id]] += 1  


        # Print some statistics about the matrix (Usefull for debugging and training)
        non_zero_values = matrix[matrix > 0]
        print(f"Matrix shape: {matrix.shape}")
        print(f"Non-zero elements: {np.count_nonzero(matrix)}")
        print(f"Sparsity: {(1 - np.count_nonzero(matrix) / matrix.size) * 100:.2f}%")
        print(f"Matrix min: {matrix.min():.3f}, max: {matrix.max():.3f}, mean: {matrix.mean():.3f}")
        if len(non_zero_values) > 0:
            print(f"Non-zero values - min: {non_zero_values.min():.3f}, max: {non_zero_values.max():.3f}, mean: {non_zero_values.mean():.3f}")
        
        return matrix, user_index, item_index
    
    def __compute_loss(self, U, V, known_pairs, lambda_reg):
        squared_error = 0
        
        for user_id, item_id, actual in known_pairs:
            predicted = np.clip(np.dot(U[user_id], V[item_id]), -10, 10)  # Clip predictions
            error = actual - predicted
            
            if not np.isfinite(error):
                print(f'Error for predicted {predicted} and actual {actual} is {error}, terminating')
                with open('item_log.txt', 'w') as f:
                    f.write(' '.join(map(str, V[item_id])) + '\n')
                    f.write(' '.join(map(str, U[user_id])) + '\n')
                return np.inf
                
            squared_error += error ** 2

        # Add small epsilon to prevent division by zero
        reg = lambda_reg * (np.linalg.norm(U) ** 2 + np.linalg.norm(V) ** 2)
        total_loss = squared_error + reg
        
        return total_loss if np.isfinite(total_loss) else np.inf
    
    def sgd(self, user_matrix, item_matrix, train_pairs, validation_pairs, 
            initial_learning_rate=0.01, reg_param=0.001, epoch=0):
        
        # Adaptive learning rate with more conservative decay
        learning_rate = initial_learning_rate / (1 + 0.0001 * epoch)
        
        # Shuffle training pairs for better convergence
        np.random.shuffle(train_pairs)

        for (u_id, i_id, actual) in train_pairs:
            user_val, item_val = user_matrix[u_id], item_matrix[i_id]

            # Clip predictions to reasonable range
            predicted = np.clip(np.dot(user_val, item_val), 0.5, 6.0)
            error = actual - predicted

            # Compute gradients
            grad_u = -2 * error * item_val + 2 * reg_param * user_val
            grad_i = -2 * error * user_val + 2 * reg_param * item_val
            
            # Clip gradients to prevent explosion
            grad_u = np.clip(grad_u, -0.1, 0.1)
            grad_i = np.clip(grad_i, -0.1, 0.1)

            # Update parameters
            user_matrix[u_id] -= learning_rate * grad_u
            item_matrix[i_id] -= learning_rate * grad_i
            
            # Ensure values remain non-negative and within reasonable range
            user_matrix[u_id] = np.clip(user_matrix[u_id], 0.001, 10.0)
            item_matrix[i_id] = np.clip(item_matrix[i_id], 0.001, 10.0)

        loss = self.__compute_loss(user_matrix, item_matrix, validation_pairs, reg_param)
        if np.isfinite(loss) and len(validation_pairs) > 0:
            rmse = np.sqrt(loss / len(validation_pairs))
            print(f"Epoch {epoch}: RMSE = {rmse:.4f}, Learning Rate = {learning_rate:.6f}")
        else:
            print(f"Epoch {epoch}: Loss became infinite, stopping training")
            return None, None

        return user_matrix, item_matrix

    def train_model(self, data, usr_indx, itm_indx, latent_factors=5, epoch_num=100):
        """Train a matrix factorization model using SGD."""

        num_users, num_items = data.shape
        num_features = latent_factors

        # Initialize based on non-zero values - proper scale for [1.25, 5.0] range
        non_zero_values = data[data > 0]
        if len(non_zero_values) > 0:
            # Scale initialization to produce predictions in the right range
            scale = np.sqrt(non_zero_values.mean() / num_features)  # ~0.66 for mean=2.175, factors=5
        else:
            scale = 0.5  # fallback
            
        np.random.seed(42)
        user_matrix = np.random.uniform(low=0.1, high=scale, size=(num_users, num_features))
        item_matrix = np.random.uniform(low=0.1, high=scale, size=(num_items, num_features))

        print('Starting training with proper sparse matrix handling...')
        
        known_pairs = []
        u, i = np.nonzero(data)
        known_pairs = list(zip(u, i, data[u, i]))

        # Store non-zero data statistics
        non_zero_values = data[data > 0]
        if len(non_zero_values) > 0:
            self._non_zero_mean = non_zero_values.mean()
        else:
            print("No training data available!")
            return user_matrix, item_matrix

        best_loss = np.inf
        patience = 10
        no_improvement_count = 0

        for epoch in range(epoch_num):
            print(f'\nEpoch {epoch + 1}/{epoch_num}:')
            
            # Split data differently each epoch
            train_pairs, val_pairs = train_test_split(
                known_pairs, 
                test_size=0.2, 
                random_state=42 + epoch
            )

            result = self.sgd(user_matrix, item_matrix, train_pairs, val_pairs, epoch=epoch)
            
            if result[0] is None:  # Training failed due to overflow
                print("Training stopped due to numerical instability")
                break
                
            user_matrix, item_matrix = result
            
            # Early stopping based on validation loss
            current_loss = self.__compute_loss(user_matrix, item_matrix, val_pairs, 0.001)
            if current_loss < best_loss:
                best_loss = current_loss
                no_improvement_count = 0
            else:
                no_improvement_count += 1
                
            if no_improvement_count >= patience:
                print(f"Early stopping at epoch {epoch + 1}")
                break

        return user_matrix, item_matrix

    def save_matrices(self, user_matrix, item_matrix):
        # Create directory if it doesn't exist
        os.makedirs('data/latent_vectors', exist_ok=True)
        
        np.save(ROOT_PATH + '/data/latent_vectors/users.npy', user_matrix)
        np.save(ROOT_PATH + '/data/latent_vectors/items.npy', item_matrix)
        print("Matrices saved successfully!")
        return True