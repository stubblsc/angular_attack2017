class CreateSongs < ActiveRecord::Migration[5.0]
  def change
    create_table :songs do |t|
      t.references :user, foreign_key: true
      t.string :name
      t.binary :payload

      t.timestamps
    end
  end
end
