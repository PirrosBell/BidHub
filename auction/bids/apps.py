from django.apps import AppConfig

class BidsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'bids'  

    def ready(self):
        from .scheduler import scheduler
        import os
        import bids.signals
        
        if os.environ.get('RUN_MAIN') != 'true':
            return
            
        scheduler.start()