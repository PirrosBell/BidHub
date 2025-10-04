from rest_framework import permissions

class IsItemOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an Item to edit it.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Admins and staff users can always edit items
        if request.user or (request.user.is_staff or request.user.is_superuser):
            return True
        
        return obj.seller.userID == request.user
    
class IsBidOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        if request.user and (request.user.is_staff or request.user.is_superuser) :
            return True
    
class BidderPerms(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):

        if request.method in permissions.SAFE_METHODS:
            return True
        
        if request.user and (request.user.is_staff or request.user.is_superuser):
            return True
        
        return obj.userID == request.user
    
class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return request.user and (request.user.is_staff or request.user.is_superuser)

class SellerPerms(permissions.BasePermission):

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):

        if request.method in permissions.SAFE_METHODS:
            return True
        
        if request.user and (request.user.is_staff or request.user.is_superuser):
            return True
        
        return obj.userID == request.user

class SellerRatingPerms(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):

        # Everyone can get a sellers profile
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Admins and staff users can always edit sellers
        if request.user and (request.user.is_staff or request.user.is_superuser):
            return True
        
        # Write permissions are only allowed to the owner of the seller  profile
        return obj.userID == request.user