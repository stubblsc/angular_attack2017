class CreateComments < ActiveRecord::Migration[5.0]
  def change
    create_table :comments do |t|
      t.references :user, foreign_key: true
      t.references :comment, foreign_key: true
      t.references :song, foreign_key: true
      t.text :body

      t.timestamps
    end
  end
end
