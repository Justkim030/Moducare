# Generated manually to seed 1,000 medicine inventory records
from django.db import migrations
import random

def seed_1000_medicines(apps, schema_editor):
    # Fetch the model state safely using your exact app routing label
    Medicine = apps.get_model('inventory', 'Medicine')

    # Medical terminology components to generate highly realistic medicine names
    prefixes = [
        'Amoxi', 'Para', 'Ibu', 'Cetri', 'Atorva', 'Omepra', 'Metfor', 'Losi', 'Cipro', 'Azithro',
        'Alpra', 'Clonaze', 'Diazme', 'Floti', 'Glimi', 'Hydrochlor', 'Metoprole', 'Simva', 'Tra',
        'Panto', 'Rosuva', 'Silge', 'Vilda', 'Sita', 'Enala', 'Lisino', 'Amlodi', 'Telmi', 'Val'
    ]
    suffixes = [
        'cillin', 'cetamol', 'profen', 'zine', 'statin', 'zole', 'formin', 'sartan', 'floxacin', 'mycin',
        'zolam', 'pam', 'xetine', 'piride', 'othiazide', 'atadine', 'olol', 'vastatin', 'madol', 'nacin',
        'prazole', 'g力的', 'gliptin', 'pril', 'dipine', 'artan', 'axine', 'terol', 'one', 'ide'
    ]
    strengths = ['2.5mg', '5mg', '10mg', '20mg', '50mg', '100mg', '250mg', '500mg', '1g']
    forms = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Ointment', 'Inhaler']

    medicines_to_create = []
    generated_names = set()

    print("\n[+] Generating 1,000 unique medicine variants...")

    while len(medicines_to_create) < 1000:
        p = random.choice(prefixes)
        s = random.choice(suffixes)
        st = random.choice(strengths)
        f = random.choice(forms)
        
        # Combine parts to form standard clinical nomenclature
        med_name = f"{p}{s} {st} ({f})"
        
        if med_name not in generated_names:
            generated_names.add(med_name)
            
            # --- SIMULATION WEIGHTS FOR DASHBOARD ALERTS ---
            dice = random.random()
            if dice < 0.04:
                quantity = 0  # ~40 Out of Stock items
            elif dice < 0.14:
                quantity = random.randint(1, 9)  # ~100 Critical Stock Alert items (< 10 units)
            else:
                quantity = random.randint(15, 450)  # ~860 Stable, moving stock rows
                
            # Prices scaled realistically based on delivery system medium (Injections/Inhalers cost more)
            base_price = random.uniform(3.50, 45.00)
            if f in ['Injection', 'Inhaler']:
                base_price *= random.uniform(2.5, 4.0)
            price = round(base_price, 2)
            
            medicines_to_create.append(
                Medicine(
                    name=med_name,
                    quantity=quantity,
                    price=price
                )
            )

    # Perform a fast transactional database bulk insert
    Medicine.objects.bulk_create(medicines_to_create, batch_size=250)
    print(f"[+] Successfully seeded {len(medicines_to_create)} rows into inventory_medicine table!")

def rollback_seed(apps, schema_editor):
    Medicine = apps.get_model('inventory', 'Medicine')
    Medicine.objects.all().delete()
    print("\n[-] Rolled back and cleared seeded items from inventory_medicine.")

class Migration(migrations.Migration):

    dependencies = [
        # Explicit dependency on your model creation step
        ('inventory', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_1000_medicines, reverse_code=rollback_seed),
    ]